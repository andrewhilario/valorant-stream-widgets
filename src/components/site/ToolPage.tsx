import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageList, type PageMeta } from "@/config/pages";
import { site } from "@/config/site";
import { breadcrumbLd } from "@/lib/seo";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";
import { SiteHeader } from "./SiteHeader";

/** Links to the other tools, described in a line each. The anchor text is the tool's own name. */
export function RelatedTools({ current }: { current: PageMeta["id"] }) {
  const others = pageList.filter((page) => page.id !== current);
  return (
    <section className="section" id="more-tools" aria-labelledby="more-tools-title">
      <h2 id="more-tools-title">More tools</h2>
      <ul className="related">
        {others.map((page) => (
          <li key={page.id}>
            <h3>
              <Link href={page.path}>{page.navLabel}</Link>
            </h3>
            <p>{page.card.sub}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The frame every calculator page shares: header, breadcrumbs, one h1 with an answer-first intro, the tool, then
 * whatever explains it. Structured data for the breadcrumb trail is added here; each page adds its own app and FAQ data.
 */
export function ToolPage({
  page,
  lede,
  data,
  children,
}: {
  page: PageMeta;
  lede: string;
  data: Array<Record<string, unknown>>;
  children: ReactNode;
}) {
  return (
    <>
      <JsonLd data={[...data, breadcrumbLd([{ name: site.name, path: "/" }, { name: page.navLabel, path: page.path }])]} />
      <SiteHeader />
      <main id="main" className="toolpage">
        <Breadcrumbs page={page} />
        <header className="toolpage__head">
          <h1>{page.h1}</h1>
          <p className="lede">{lede}</p>
        </header>
        {children}
        <RelatedTools current={page.id} />
      </main>
      <Footer />
    </>
  );
}
