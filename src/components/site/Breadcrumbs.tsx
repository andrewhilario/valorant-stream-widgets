import Link from "next/link";
import { pages, type PageMeta } from "@/config/pages";
import { site } from "@/config/site";

/** Visible breadcrumb for tool pages. The matching BreadcrumbList JSON-LD sits beside it in each page. */
export function Breadcrumbs({ page }: { page: PageMeta }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href={pages.overlay.path}>{site.name}</Link>
        </li>
        <li aria-current="page">{page.navLabel}</li>
      </ol>
    </nav>
  );
}
