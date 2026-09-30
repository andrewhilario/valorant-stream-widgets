"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromLocation, sanitize, type Config } from "@/lib/schema";
import { defaults, readConfig, schema } from "./definition";
import type { SampleVariant } from "./sample";
import { useRankData, useTierIcons } from "./useRankData";
import { RankWidget } from "./Widget";

type ConfigMessage = { t: "config"; config: Config; sample: boolean };

const DEMOS: SampleVariant[] = ["diamond", "immortal", "radiant", "unrated"];

/**
 * The page OBS loads. Reads its settings from the link, polls for data, and
 * shows nothing the audience shouldn't see: no errors, no loading text.
 *
 * With ?preview=1 (the editor's iframe) it also listens for setting changes
 * over postMessage and reports its size and data status back, so the preview
 * is the real widget page, not a lookalike.
 */
export function RankRuntime() {
  const [config, setConfig] = useState<Config | null>(null);
  const [preview, setPreview] = useState(false);
  const [sample, setSample] = useState<false | SampleVariant>(false);
  const [fontsReady, setFontsReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const icons = useTierIcons();

  // Read the link once: settings from the query string, the API key from the #fragment.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConfig(fromLocation(schema, window.location.search, window.location.hash));
    setPreview(params.get("preview") === "1");
    const demo = params.get("demo");
    if (demo) setSample(DEMOS.includes(demo as SampleVariant) ? (demo as SampleVariant) : "diamond");
  }, []);

  const cfg = useMemo(() => readConfig(config ?? defaults), [config]);

  const { data, status, now } = useRankData({
    riotId: cfg.riotId,
    region: cfg.region,
    platform: cfg.platform,
    apiKey: cfg.apiKey,
    refresh: cfg.refresh,
    sample,
    debounceMs: preview ? 600 : 0,
  });

  // Preview only: take setting changes from the editor.
  useEffect(() => {
    if (!preview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as Partial<ConfigMessage> | null;
      if (message?.t !== "config" || !message.config) return;
      setConfig(sanitize(schema, message.config));
      setSample(message.sample ? "diamond" : false);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ t: "ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [preview]);

  // Preview only: tell the editor how the lookup is going.
  useEffect(() => {
    if (!preview) return;
    window.parent.postMessage(
      {
        t: "status",
        status,
        account: data ? `${data.account.name}#${data.account.tag}` : null,
        tier: data ? data.current.tier : null,
      },
      window.location.origin,
    );
  }, [preview, status, data]);

  // Preview only: report the size OBS's Browser Source needs.
  const mounted = config !== null;
  useEffect(() => {
    if (!preview || !mounted) return;
    const el = rootRef.current?.firstElementChild;
    if (!el) return;
    const report = () => {
      const rect = el.getBoundingClientRect();
      window.parent.postMessage(
        { t: "size", w: Math.ceil(rect.width), h: Math.ceil(rect.height) },
        window.location.origin,
      );
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, [preview, mounted]);

  // Hold the fade-in until the web fonts are in, so the audience never sees a flash of fallback type.
  useEffect(() => {
    if (!mounted) return;
    let on = true;
    const done = () => on && setFontsReady(true);
    const fallback = setTimeout(done, 1500);
    const frame = requestAnimationFrame(() => {
      void document.fonts.ready.then(() => {
        clearTimeout(fallback);
        done();
      });
    });
    return () => {
      on = false;
      clearTimeout(fallback);
      cancelAnimationFrame(frame);
    };
  }, [mounted, cfg.font]);

  const ready = fontsReady && (data !== null || preview);

  return (
    <div className="w-root" ref={rootRef}>
      {mounted && <RankWidget config={cfg} data={data} icons={icons} now={now} ready={ready} />}
    </div>
  );
}
