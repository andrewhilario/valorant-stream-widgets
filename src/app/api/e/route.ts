import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BINDING, handleEvent, type EventSink } from "@/lib/event-endpoint";

// An anonymous event counter, and the only route on the site that runs on a server. What it accepts is in
// src/lib/events.ts, and what it does with it is in src/lib/event-endpoint.ts.

function sink(): EventSink | null {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    return (env[BINDING] as EventSink | undefined) ?? null;
  } catch {
    // `next dev` and `next start` have no Cloudflare bindings.
    return null;
  }
}

export async function POST(request: Request) {
  return handleEvent(request, sink());
}
