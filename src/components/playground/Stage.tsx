"use client";

import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CANVAS, type Format } from "@/lib/canvas";
import { Status } from "./Status";
import { usePlayground, type Anchor, type Backdrop } from "./usePlayground";
import { useStageTilt } from "./useStageTilt";

/** Title-safe margin, in canvas pixels. */
const MARGIN = 48;
/** Width of a phone player in portrait, in CSS pixels. */
const PHONE_W = 390;

const BACKDROPS: Array<{ value: Backdrop; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "bright", label: "Bright" },
  { value: "busy", label: "Busy" },
  { value: "clear", label: "Clear" },
];

const FORMATS: Format[] = ["landscape", "vertical"];

const ANCHORS: Array<{ value: Anchor; label: string; Icon: typeof ArrowUpLeft }> = [
  { value: "tl", label: "Top left", Icon: ArrowUpLeft },
  { value: "tr", label: "Top right", Icon: ArrowUpRight },
  { value: "bl", label: "Bottom left", Icon: ArrowDownLeft },
  { value: "br", label: "Bottom right", Icon: ArrowDownRight },
];

export function Title() {
  const { widget } = usePlayground();
  return (
    <div className="title">
      <h1 id="page-title">{widget.name} for OBS</h1>
      <p className="lede">{widget.tagline} One link into OBS. Free, no account.</p>
    </div>
  );
}

export function StageToolbar() {
  const pg = usePlayground();
  const tryouts = pg.widget.tryouts;
  const blocked = tryouts?.blocked(pg.config) ?? null;

  return (
    <div className="toolbar" role="group" aria-label="Preview options">
      <div className="tool" role="radiogroup" aria-labelledby="tool-backdrop">
        <span className="tool__label" id="tool-backdrop">
          Backdrop
        </span>
        <div className="seg seg--sm">
          {BACKDROPS.map((b) => (
            <label key={b.value} className="seg__opt">
              <input
                type="radio"
                name="backdrop"
                value={b.value}
                checked={pg.backdrop === b.value}
                onChange={() => pg.setBackdrop(b.value)}
              />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="tool" role="radiogroup" aria-labelledby="tool-canvas">
        <span className="tool__label" id="tool-canvas">
          Canvas
        </span>
        <div className="seg seg--sm">
          {FORMATS.map((f) => (
            <label key={f} className="seg__opt">
              <input
                type="radio"
                name="format"
                value={f}
                checked={pg.format === f}
                onChange={() => pg.setFormat(f)}
              />
              <span>{CANVAS[f].label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="tool" role="radiogroup" aria-label="Widget position in the preview">
        <div className="seg seg--sm seg--icons">
          {ANCHORS.map(({ value, label, Icon }) => (
            <label key={value} className="seg__opt">
              <input
                type="radio"
                name="anchor"
                value={value}
                checked={pg.anchor === value}
                onChange={() => pg.setAnchor(value)}
                aria-label={label}
                title={label}
              />
              <span>
                <Icon aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="tool" role="radiogroup" aria-labelledby="tool-view">
        <span className="tool__label" id="tool-view">
          View
        </span>
        <div className="seg seg--sm">
          <label className="seg__opt">
            <input type="radio" name="view" value="fit" checked={pg.view === "fit"} onChange={() => pg.setView("fit")} />
            <span>Fit</span>
          </label>
          <label className="seg__opt">
            <input
              type="radio"
              name="view"
              value="phone"
              checked={pg.view === "phone"}
              onChange={() => pg.setView("phone")}
            />
            <span>Phone</span>
          </label>
        </div>
      </div>

      {tryouts && (
        <div className="tool tool--wrap" role="group" aria-labelledby="tool-try">
          <span className="tool__label" id="tool-try">
            {tryouts.label}
          </span>
          {blocked ? (
            <button type="button" className="linkbtn linkbtn--sm" onClick={() => pg.focusControl(blocked.focus)}>
              {blocked.message}. Turn it on
            </button>
          ) : (
            <div className="seg seg--sm">
              {tryouts.options.map((option) => (
                <button key={option.kind} type="button" className="seg__btn" onClick={() => pg.tryout(option.kind)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Swaps between invented numbers and the streamer's own, in words, next to the status it changes. */
function SampleToggle() {
  const pg = usePlayground();

  if (pg.sample && pg.needs) {
    const { message, focus } = pg.needs;
    return (
      <button type="button" className="linkbtn linkbtn--sm" onClick={() => pg.focusControl(focus)}>
        {message}
      </button>
    );
  }
  return (
    <button type="button" className="linkbtn linkbtn--sm" onClick={() => pg.setSample(!pg.sample)}>
      {pg.sample ? "Show my rank" : "Use sample data"}
    </button>
  );
}

/**
 * A canvas (1920 × 1080, or 1080 × 1920 for vertical streams) holding the real
 * widget page in an iframe, scaled to fit. "Phone" shows it at what a 390 px-wide
 * player would — the honest test of whether small text survives a viewer's screen.
 */
export function Stage() {
  const pg = usePlayground();
  const areaRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 600, h: 340 });
  const nextGame = useRef(0);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setArea({ w: width, h: height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  const canvas = CANVAS[pg.format];
  const fit = Math.min(area.w / canvas.w, area.h / canvas.h);
  // Phone view is true phone scale, never wider than the stage. A tall canvas scrolls inside the stage.
  const phone = Math.min(PHONE_W / canvas.w, area.w / canvas.w);
  const k = pg.view === "phone" ? phone : fit;
  const percent = Math.round(k * 100);

  const frame: CSSProperties = {
    width: pg.size.w,
    height: pg.size.h,
    [pg.anchor.includes("l") ? "left" : "right"]: MARGIN,
    [pg.anchor.includes("t") ? "top" : "bottom"]: MARGIN,
  };

  // Pointing at the widget leans it; clicking it plays the next game in the list (win, loss, rank up, rank down, and round).
  const tryouts = pg.widget.tryouts;
  const canPlay = Boolean(tryouts && tryouts.options.length > 0 && tryouts.blocked(pg.config) === null);
  const pointer = useStageTilt({
    fitRef,
    frameRef: pg.frameRef,
    scale: k,
    canPlay,
    onPlay: () => {
      if (!tryouts) return;
      pg.tryout(tryouts.options[nextGame.current % tryouts.options.length].kind);
      nextGame.current += 1;
    },
  });

  return (
    <div className="stage">
      <div className="stage__area" ref={areaRef} data-format={pg.format} data-view={pg.view}>
        <div
          className="stage__fit"
          ref={fitRef}
          style={{ width: canvas.w * k, height: canvas.h * k }}
          data-backdrop={pg.backdrop}
          {...pointer}
        >
          <div className="stage__canvas" style={{ width: canvas.w, height: canvas.h, transform: `scale(${k})` }}>
            {pg.initialSrc && (
              <iframe
                ref={pg.frameRef}
                className="stage__frame"
                src={pg.initialSrc}
                title="Live preview of the widget"
                tabIndex={-1}
                style={frame}
              />
            )}
          </div>
        </div>
      </div>

      <div className="stage__foot">
        <div className="stage__state">
          <Status />
          <SampleToggle />
        </div>
        <div className="stage__notes" data-trial={pg.trialLabel ? "true" : "false"}>
          <p className="stage__caption">
            <span className="mono">
              {canvas.w}&nbsp;×&nbsp;{canvas.h}
            </span>{" "}
            canvas, shown at <span className="mono">{percent}%</span>
            {pg.view === "phone" && <> — how it reads on a player about {PHONE_W}&nbsp;px wide</>}
            {canPlay && (
              <span className="stage__tip">
                {" "}
                · <span data-input="mouse">Click</span>
                <span data-input="touch">Tap</span> the widget to try a game
              </span>
            )}
          </p>
          {/* Only a mouse can point at a theme without picking it, so this is for the eyes alone. */}
          <p className="stage__caption stage__caption--trial" aria-hidden="true">
            {pg.trialLabel && (
              <>
                Previewing <b>{pg.trialLabel}</b>. Click it to keep it.
              </>
            )}
          </p>
        </div>
      </div>

      {pg.format === "vertical" && pg.config.layout !== "stack" && (
        <p className="stage__hint">
          Vertical streams suit the Stack layout.{" "}
          <button type="button" className="linkbtn linkbtn--sm" onClick={() => pg.set("layout", "stack")}>
            Use Stack
          </button>
        </p>
      )}
    </div>
  );
}
