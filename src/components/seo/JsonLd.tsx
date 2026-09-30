import { serializeLd } from "@/lib/seo";

/** Structured data for search engines. Server-rendered, so it is in the HTML crawlers fetch. */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLd(data) }} />;
}
