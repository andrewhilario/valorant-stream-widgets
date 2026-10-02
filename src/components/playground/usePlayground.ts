"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isFormat, type Format } from "@/lib/canvas";
import { copyText } from "@/lib/clipboard";
import type { ConfigMessage, PreviewStatus, ReactMessage, WidgetMessage } from "@/lib/preview";
import { widgetStorageKey } from "@/lib/storage-keys";
import {
  applyChoice,
  controlsOf,
  fromParams,
  sanitize,
  sanitizeValue,
  secretHash,
  toParams,
  withChoice,
  type Config,
  type ConfigValue,
} from "@/lib/schema";
import type { WidgetMeta } from "@/widgets/registry";

export type Backdrop = "dark" | "bright" | "busy" | "clear";
export type Anchor = "tl" | "tr" | "bl" | "br";
export type View = "fit" | "phone";
export type CopyState = "idle" | "copied" | "failed";

const BACKDROPS: Backdrop[] = ["dark", "bright", "busy", "clear"];
const ANCHORS: Anchor[] = ["tl", "tr", "bl", "br"];
const VIEWS: View[] = ["fit", "phone"];

const UI_KEY = "tally:ui:v1";
const DEFAULT_SIZE = { w: 416, h: 213 };

type Preview = { status: PreviewStatus; account: string | null; tier: string | null };

const noopSubscribe = () => () => {};

/** Everything the editor needs. One instance, shared through context. */
export function usePlaygroundState(widget: WidgetMeta) {
  const { schema, defaults } = widget;
  const controls = useMemo(() => controlsOf(schema), [schema]);
  const storageKey = widgetStorageKey(widget.id);

  const [config, setConfig] = useState<Config>(defaults);
  const configRef = useRef(config);
  configRef.current = config;

  const [ready, setReady] = useState(false);
  const [initialSrc, setInitialSrc] = useState<string | null>(null);

  const [backdrop, setBackdrop] = useState<Backdrop>("dark");
  const [anchor, setAnchor] = useState<Anchor>("tl");
  const [view, setView] = useState<View>("fit");
  const [format, setFormat] = useState<Format>("landscape");

  const [sample, setSampleState] = useState(true);
  const manualSample = useRef(false);

  // A choice being tried (pointer over a theme card) and a game being played ("Try a game"). Neither is saved or put in the
  // link; they only change what the preview shows.
  const [trial, setTrial] = useState<{ key: string; value: string } | null>(null);
  const [play, setPlay] = useState({ kind: "", n: 0 });
  const playSent = useRef(0);

  const [size, setSize] = useState(DEFAULT_SIZE);
  const [preview, setPreview] = useState<Preview>({ status: { state: "idle" }, account: null, tier: null });
  const [readyTick, setReadyTick] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [copied, setCopied] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [undoConfig, setUndoConfig] = useState<Config | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [activeTab, setActiveTab] = useState(schema.sections[0].id);
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});

  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );

  const needs = widget.needs(config);
  const configured = needs === null;

  // ── Load: link → saved settings → first-run defaults ─────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let saved: Config | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) saved = sanitize(schema, JSON.parse(raw) as Record<string, unknown>);
    } catch {
      // Storage can be blocked or corrupt; start fresh.
    }

    let initial: Config | null = null;
    if (controls.some((c) => !c.secret && params.has(c.param))) {
      // Settings come from the address bar. Secrets never do: they come from this browser's saved copy.
      initial = fromParams(schema, params);
      for (const c of controls) if (c.secret) initial[c.key] = saved?.[c.key] ?? c.default;
    } else {
      initial = saved;
    }

    if (!initial) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      initial = widget.firstRun ? widget.firstRun(defaults, { timeZone }) : defaults;
    }

    try {
      const ui = JSON.parse(window.localStorage.getItem(UI_KEY) ?? "null") as Record<string, string> | null;
      if (ui) {
        if (BACKDROPS.includes(ui.backdrop as Backdrop)) setBackdrop(ui.backdrop as Backdrop);
        if (ANCHORS.includes(ui.anchor as Anchor)) setAnchor(ui.anchor as Anchor);
        if (VIEWS.includes(ui.view as View)) setView(ui.view as View);
        if (isFormat(ui.format)) setFormat(ui.format);
      }
    } catch {
      // Preferences are a convenience only.
    }

    setConfig(initial);
    setSampleState(widget.needs(initial) !== null);
    setReady(true);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The iframe loads once with the starting settings; later changes go over postMessage.
  useEffect(() => {
    if (!ready || initialSrc !== null) return;
    const params = toParams(schema, configRef.current);
    params.set("preview", "1");
    if (sample) params.set("demo", "1");
    const hash = secretHash(schema, configRef.current);
    setInitialSrc(`/w/${widget.id}?${params.toString()}${hash ? `#${hash}` : ""}`);
  }, [ready, initialSrc, schema, widget.id, sample]);

  // ── Persist: saved settings and the address bar ──────────────────────────
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      } catch {
        // ignore
      }
      const query = toParams(schema, config).toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }, 300);
    return () => clearTimeout(id);
  }, [config, ready, schema, storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify({ backdrop, anchor, view, format }));
    } catch {
      // ignore
    }
  }, [backdrop, anchor, view, format, ready]);

  // ── Preview iframe: messages in and out ──────────────────────────────────
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as WidgetMessage | null;
      if (!message || typeof message !== "object") return;

      if (message.t === "ready") setReadyTick((n) => n + 1);
      else if (message.t === "size" && message.w > 0 && message.h > 0 && message.w < 4000 && message.h < 4000) {
        setSize((prev) => (prev.w === message.w && prev.h === message.h ? prev : { w: message.w, h: message.h }));
      } else if (message.t === "status") {
        setPreview({ status: message.status, account: message.account, tier: message.tier });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // What the preview shows: the saved settings, unless a choice is being tried. Trying the choice that's already picked
  // changes nothing (picking it again wouldn't either).
  const shown = useMemo(
    () => (trial && config[trial.key] !== trial.value ? withChoice(controls, config, trial.key, trial.value) : config),
    [controls, config, trial],
  );
  const trialLabel = useMemo(() => {
    if (!trial || shown === config) return null;
    const control = controls.find((c) => c.key === trial.key);
    return control?.kind === "choice" ? (control.options.find((o) => o.value === trial.value)?.label ?? null) : null;
  }, [controls, config, shown, trial]);

  /** Try a choice's option on the preview without picking it; `null` puts the real settings back. */
  const tryChoice = useCallback((key: string, value: string | null) => {
    setTrial((prev) => {
      if (value === null) return null;
      return prev?.key === key && prev.value === value ? prev : { key, value };
    });
  }, []);

  // A game to play always goes out after the config it belongs to, so the widget is already on sample data when it lands.
  useEffect(() => {
    if (readyTick === 0) return;
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const message: ConfigMessage = { t: "config", config: shown, sample };
    target.postMessage(message, window.location.origin);
    if (play.n !== playSent.current) {
      playSent.current = play.n;
      const react: ReactMessage = { t: "react", kind: play.kind, n: play.n };
      target.postMessage(react, window.location.origin);
    }
  }, [shown, sample, readyTick, play]);

  // Show sample data until there is a valid account, unless the user chose.
  useEffect(() => {
    if (!ready || manualSample.current) return;
    setSampleState(!configured);
  }, [configured, ready]);

  const setSample = useCallback((value: boolean) => {
    manualSample.current = true;
    setSampleState(value);
  }, []);

  /** Plays a made-up game on sample data (switching to it if the preview is on live numbers). */
  const tryout = useCallback((kind: string) => {
    manualSample.current = true;
    setSampleState(true);
    setPlay((prev) => ({ kind, n: prev.n + 1 }));
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────
  const set = useCallback(
    (key: string, value: ConfigValue) => {
      const control = controls.find((c) => c.key === key);
      if (!control) return;
      const clean = sanitizeValue(control, value);
      setConfig((prev) => (control.kind === "choice" ? applyChoice(control, prev, String(clean)) : { ...prev, [key]: clean }));
    },
    [controls],
  );

  const reset = useCallback(() => {
    const previous = configRef.current;
    const account = schema.sections.find((s) => s.id === "account");
    const next: Config = { ...defaults };
    for (const c of account?.controls ?? []) next[c.key] = previous[c.key];

    setConfig(next);
    setUndoConfig(previous);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoConfig(null), 8000);
  }, [schema, defaults]);

  const undo = useCallback(() => {
    if (!undoConfig) return;
    setConfig(undoConfig);
    setUndoConfig(null);
    clearTimeout(undoTimer.current);
  }, [undoConfig]);

  const dismissUndo = useCallback(() => {
    setUndoConfig(null);
    clearTimeout(undoTimer.current);
  }, []);

  // ── Output ───────────────────────────────────────────────────────────────
  // The link carries the API key after a "#", which browsers never send to a server.
  // `maskedUrl` is what gets shown on screen; `url` is what gets copied.
  const { url, maskedUrl } = useMemo(() => {
    if (!origin || !configured) return { url: null, maskedUrl: null };
    const query = toParams(schema, config).toString();
    const base = `${origin}/w/${widget.id}${query ? `?${query}` : ""}`;
    const real = secretHash(schema, config);
    const hidden = secretHash(schema, config, true);
    return { url: `${base}${real ? `#${real}` : ""}`, maskedUrl: `${base}${hidden ? `#${hidden}` : ""}` };
  }, [origin, configured, schema, config, widget.id]);

  const copy = useCallback(async () => {
    if (!url) return;
    const ok = await copyText(url);
    setCopied(ok ? "copied" : "failed");
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied("idle"), ok ? 2500 : 5000);
  }, [url]);

  // ── Navigation helpers (used by the command palette) ─────────────────────
  // A focus request is state, applied by an effect once React has rendered the target tab
  // and opened its Advanced drawer. No timers to race, and nothing that stalls in a background tab.
  const [focusRequest, setFocusRequest] = useState<{ key: string; flag?: string; n: number } | null>(null);

  const focusControl = useCallback(
    (key: string, flag?: string) => {
      const section = schema.sections.find((s) => s.controls.some((c) => c.key === key));
      if (!section) return;
      setActiveTab(section.id);
      if (section.controls.find((c) => c.key === key)?.advanced) {
        setAdvancedOpen((open) => ({ ...open, [section.id]: true }));
      }
      setFocusRequest((prev) => ({ key, flag, n: (prev?.n ?? 0) + 1 }));
    },
    [schema],
  );

  useEffect(() => {
    if (!focusRequest) return;
    const { key, flag } = focusRequest;
    const base = `[data-ctl="${key}"]`;
    const el = flag
      ? document.querySelector<HTMLElement>(`${base}[data-flag="${flag}"]`)
      : (document.querySelector<HTMLElement>(`${base}:checked`) ?? document.querySelector<HTMLElement>(base));
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
    setFocusRequest(null);
  }, [focusRequest]);

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
      clearTimeout(undoTimer.current);
    },
    [],
  );

  return {
    widget,
    controls,
    config,
    set,
    reset,
    undo,
    dismissUndo,
    canUndo: undoConfig !== null,
    ready,
    needs,
    configured,
    sample,
    setSample,
    tryChoice,
    trialLabel,
    tryout,
    backdrop,
    setBackdrop,
    anchor,
    setAnchor,
    view,
    setView,
    format,
    setFormat,
    size,
    preview,
    frameRef,
    initialSrc,
    origin,
    url,
    maskedUrl,
    copied,
    copy,
    activeTab,
    setActiveTab,
    advancedOpen,
    setAdvancedOpen,
    focusControl,
  };
}

export type Playground = ReturnType<typeof usePlaygroundState>;

export const PlaygroundContext = createContext<Playground | null>(null);

export function usePlayground(): Playground {
  const value = useContext(PlaygroundContext);
  if (!value) throw new Error("usePlayground must be used inside <Playground>");
  return value;
}
