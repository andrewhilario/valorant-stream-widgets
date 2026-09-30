import Link from "next/link";
import { pageList } from "@/config/pages";
import { site } from "@/config/site";
import { SupportLink } from "../sections/SupportLink";

function Sep() {
  return (
    <span className="foot__sep" aria-hidden="true">
      ·
    </span>
  );
}

/** Ft2: one line, hairline above. Also the site's plain-HTML map of every tool, for people and crawlers alike. */
export function Footer() {
  return (
    <footer className="foot">
      <p className="foot__line">
        <span className="foot__brand">{site.name}</span>
        <Sep />
        <span>Free, no account</span>
        {pageList.map((page) => (
          <span key={page.id} className="foot__item">
            <Sep />
            <Link className="textlink" href={page.path}>
              {page.navLabel}
            </Link>
          </span>
        ))}
        <Sep />
        <SupportLink variant="link" />
        <Sep />
        <span>Not affiliated with Riot Games</span>
        <Sep />
        <span>© {new Date().getFullYear()}</span>
      </p>
    </footer>
  );
}
