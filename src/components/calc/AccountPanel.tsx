"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { loadAccount, saveAccount } from "@/lib/account-store";
import { looksLikeKey } from "@/lib/henrik-client";
import { guessRegion, parseRiotId, type Platform, type Region } from "@/lib/riot";
import { controlsOf, type ChoiceControl, type TextControl } from "@/lib/schema";
import type { Snapshot } from "@/lib/snapshot";
import { schema } from "@/widgets/valorant-rank/definition";
import { Segmented } from "../controls/Segmented";
import { TextField } from "../controls/TextField";
import { toPreviewStatus, useSnapshot } from "./useSnapshot";

// The same four controls the overlay editor uses, so the wording, validation and "how to get a key" steps match.
const controls = controlsOf(schema);
const find = <T,>(key: string) => controls.find((c) => c.key === key) as T;
const RIOT_ID = find<TextControl>("riotId");
const API_KEY = find<TextControl>("apiKey");
const REGION = find<ChoiceControl>("region");
const PLATFORM = find<ChoiceControl>("platform");

/**
 * "Use my recent ranked games": the streamer's own HenrikDev key, straight from this browser to HenrikDev.
 * `onLoaded` receives the result and may return one more sentence to show (for example, why a rank wasn't filled in).
 */
export function AccountPanel({ onLoaded, summary }: { onLoaded: (snapshot: Snapshot) => string | null; summary: string }) {
  const id = useId();
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState<Region>("na");
  const [platform, setPlatform] = useState<Platform>("pc");
  const [key, setKey] = useState("");
  const [tried, setTried] = useState(false);
  const [follow, setFollow] = useState<string | null>(null);
  const { state, load, reset } = useSnapshot();

  // Whatever the editor (or an earlier visit here) saved, else a region guessed from the time zone, as the editor
  // does. Read after mount so the server and browser markup match.
  useEffect(() => {
    const guess = guessRegion(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const saved = loadAccount(guess);
    if (!saved) {
      setRegion(guess);
      return;
    }
    setRiotId(saved.riotId);
    setRegion(saved.region);
    setPlatform(saved.platform);
    setKey(saved.key);
  }, []);

  const parsed = parseRiotId(riotId);
  const ready = parsed !== null && looksLikeKey(key);

  // Editing a field makes the last answer stale, so its ticks and messages go with it.
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setTried(false);
    setFollow(null);
    reset();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state.phase === "loading") return;
    if (!parsed || !looksLikeKey(key)) {
      setTried(true);
      return;
    }
    setFollow(null);
    const snapshot = await load({ region, platform, name: parsed.name, tag: parsed.tag, key: key.trim() });
    if (!snapshot) return;
    saveAccount({ riotId: riotId.trim(), region, platform, key: key.trim() });
    setFollow(onLoaded(snapshot));
  }

  const loading = state.phase === "loading";
  const snapshot = state.phase === "ready" ? state.snapshot : null;

  const lookup = {
    status: toPreviewStatus(state),
    account: snapshot ? `${snapshot.account.name}#${snapshot.account.tag}` : null,
    tier: snapshot ? snapshot.rank.tier : null,
    configured: ready,
    sample: false,
  };

  let tone: "error" | "busy" | "ok" | "none" = "none";
  let message = "";
  if (state.phase === "error") {
    tone = "error";
    message = state.message;
  } else if (loading) {
    tone = "busy";
    message = "Loading your recent games…";
  } else if (snapshot) {
    tone = "ok";
    const count = snapshot.games === 1 ? "1 ranked game" : `${snapshot.games} ranked games`;
    message = `Loaded ${count} for ${snapshot.account.name}#${snapshot.account.tag}.${follow ? ` ${follow}` : ""}`;
  } else if (tried && !ready) {
    tone = "error";
    message = "Add your Riot ID and HenrikDev key first.";
  }

  return (
    <details className="lookup">
      <summary>{summary}</summary>
      <form className="lookup__body" onSubmit={submit} noValidate>
        <p className="lookup__intro">
          Fills in numbers from your last ranked games. Your key stays in this browser and goes straight to HenrikDev, not through this
          site.
        </p>
        <TextField control={RIOT_ID} value={riotId} onChange={edit(setRiotId)} lookup={lookup} />
        <Segmented control={REGION} value={region} onChange={edit((v: string) => setRegion(v as Region))} />
        <TextField control={API_KEY} value={key} onChange={edit(setKey)} lookup={lookup} />
        <Segmented control={PLATFORM} value={platform} onChange={edit((v: string) => setPlatform(v as Platform))} />

        <div className="lookup__actions">
          <button
            type="submit"
            className="chip lookup__button"
            aria-disabled={!ready || loading}
            aria-describedby={`${id}-status`}
            onClick={(event) => {
              if (loading) event.preventDefault();
            }}
          >
            {loading && <LoaderCircle aria-hidden="true" className="input__icon--busy" />}
            <span>{loading ? "Loading…" : snapshot ? "Load again" : "Load my games"}</span>
          </button>
          <p className="lookup__status" id={`${id}-status`} role="status" data-tone={tone}>
            {message}
          </p>
        </div>
      </form>
    </details>
  );
}
