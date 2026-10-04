"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromLocation, sanitize, type Config } from "@/lib/schema";
import { defaults, readConfig, schema } from "./definition";
import type { MasteryData, MasteryReaction, MasteryReactionKind } from "./mastery-types";
import {
  detectMasteryReaction,
  MASTERY_REACTION_KINDS,
  simulateMasteryGain,
} from "./reactions";
import type { MasterySampleVariant } from "./sample";
import { useAgentMap, useMasteryData } from "./useMasteryData";
import { MasteryWidget } from "./Widget";

type ConfigMessage = { t: "config"; config: Config; sample: boolean };
type ReactMessage = { t: "react"; kind: string; n: number };

const DEMOS: MasterySampleVariant[] = ["early", "mid", "late"];

export function MasteryRuntime() {
  const [config, setConfig] = useState<Config | null>(null);
  const [preview, setPreview] = useState(false);
  const [sample, setSample] = useState<false | MasterySampleVariant>(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [request, setRequest] = useState<{ kind: MasteryReactionKind; n: number } | null>(null);
  const [test, setTest] = useState<MasteryData | null>(null);
  const [reaction, setReaction] = useState<MasteryReaction | null>(null);
  const [compared, setCompared] = useState<MasteryData | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const agents = useAgentMap();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setConfig(fromLocation(schema, window.location.search, window.location.hash));
    setPreview(params.get("preview") === "1");
    const demo = params.get("demo");
    if (demo) setSample(DEMOS.includes(demo as MasterySampleVariant) ? (demo as MasterySampleVariant) : "mid");
  }, []);

  const cfg = useMemo(() => readConfig(config ?? defaults), [config]);

  const { data, status, now } = useMasteryData({
    riotId: cfg.riotId,
    region: cfg.region,
    platform: cfg.platform,
    apiKey: cfg.apiKey,
    agentId: cfg.agentId,
    agentName: cfg.agentName,
    currentLevel: Number(cfg.currentLevel) || 0,
    mpIntoLevel: Number(cfg.mpIntoLevel) || 0,
    targetLevel: Number(cfg.targetLevel) || 10,
    bonusPct: cfg.bonusPct,
    refresh: cfg.refresh,
    sample,
    debounceMs: preview ? 600 : 0,
  });

  const agent = useMemo(() => {
    if (cfg.agentId && agents[cfg.agentId]) return agents[cfg.agentId];
    if (cfg.agentName && agents[cfg.agentName.toLowerCase()]) return agents[cfg.agentName.toLowerCase()];
    // Fallback if sample
    if (sample && agents["add6443a-41bd-e414-f6ad-e58d267f4e95"]) return agents["add6443a-41bd-e414-f6ad-e58d267f4e95"];
    return null;
  }, [cfg.agentId, cfg.agentName, agents, sample]);

  // Preview only: handle setting changes and "try" events
  useEffect(() => {
    if (!preview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as (Partial<ConfigMessage> & Partial<ReactMessage>) | null;
      if (message?.t === "config" && message.config) {
        setConfig(sanitize(schema, message.config));
        setSample(message.sample ? "mid" : false);
      } else if (
        message?.t === "react" &&
        typeof message.n === "number" &&
        MASTERY_REACTION_KINDS.includes(message.kind as MasteryReactionKind)
      ) {
        setRequest({ kind: message.kind as MasteryReactionKind, n: message.n });
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ t: "ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [preview]);

  useEffect(() => {
    setTest(null);
  }, [sample, data]);

  const shown = test ?? data;

  useEffect(() => {
    if (!request || !sample || !shown) return;
    setRequest(null);
    setTest(simulateMasteryGain(shown, request.kind));
  }, [request, sample, shown]);

  if (shown !== compared) {
    setCompared(shown);
    const kind = detectMasteryReaction(compared, shown);
    if (kind) setReaction((previous) => ({ kind, n: (previous?.n ?? 0) + 1 }));
  }

  // Preview only: report status to editor
  useEffect(() => {
    if (!preview) return;
    window.parent.postMessage(
      {
        t: "status",
        status,
        account: cfg.riotId || (sample ? "Sample" : null),
        tier: `Level ${shown?.currentLevel ?? cfg.currentLevel}`,
      },
      window.location.origin,
    );
  }, [preview, status, cfg.riotId, cfg.currentLevel, shown?.currentLevel, sample]);

  // Preview only: report dimensions
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
    <div className="m-root" ref={rootRef}>
      {mounted && (
        <MasteryWidget
          config={cfg}
          data={shown}
          agent={agent}
          ready={ready}
          reaction={reaction}
        />
      )}
    </div>
  );
}
