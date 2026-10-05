// The one piece of server code on this site: it takes an event from events.ts and adds one to a counter. It keeps no
// cookie, no ID, no IP address and no log of requests; what it writes is the event name and its two labels, and Cloudflare
// Workers Analytics Engine keeps those for three months. It lives here, away from the route file, so it can be tested
// without Cloudflare.

import { parseEvent, toDataPoint, type DataPoint } from "./events";

/** The name of the Analytics Engine binding in wrangler.jsonc. */
export const BINDING = "EVENTS";

/** What the endpoint needs from Cloudflare: Workers Analytics Engine's write call. */
export type EventSink = { writeDataPoint(point: DataPoint): void };

/** A valid event is under 100 characters, so anything near this size isn't one. */
const MAX_BODY = 256;

/**
 * `stored` is only given for an accepted event, as an `X-Counted: yes|no` header. Pages ignore it. It is there so that after a
 * deploy `curl -i` can tell "the counter is wired up" from "events are accepted and silently dropped" (see the README).
 */
const reply = (status: number, stored?: boolean) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "no-store", ...(stored === undefined ? {} : { "X-Counted": stored ? "yes" : "no" }) },
  });

/** Only this site's own pages may post here: the Origin header has to name the host the request came to. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** `sink` is null where there is no Cloudflare binding (local development): the event is checked, then dropped. */
export async function handleEvent(request: Request, sink: EventSink | null): Promise<Response> {
  if (request.method !== "POST") return reply(405);
  if (!sameOrigin(request)) return reply(403);

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) return reply(413);

  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413);

  const counted = parseEvent(text);
  if (!counted) return reply(400);

  let stored = false;
  try {
    if (sink) {
      sink.writeDataPoint(toDataPoint(counted));
      stored = true;
    }
  } catch {
    // A counter must never turn into an error on somebody's page.
  }
  return reply(204, stored);
}
