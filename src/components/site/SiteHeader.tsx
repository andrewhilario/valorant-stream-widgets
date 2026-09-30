"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pageList } from "@/config/pages";
import { site } from "@/config/site";
import { usePalette } from "./PaletteProvider";

/** N13: wordmark, a search pill that opens the palette, page links, and an optional page action. */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  const { setOpen } = usePalette();
  const pathname = usePathname();

  // ⌘ on Apple hardware, Ctrl elsewhere. Decided after mount so server and client markup match.
  const [apple, setApple] = useState(false);
  useEffect(() => {
    setApple(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="nav">
        <div className="nav__inner">
          <Link className="nav__brand" href="/" aria-label={`${site.name}, home`}>
            <span className="nav__dot" aria-hidden="true" />
            <span>{site.name}</span>
          </Link>

          <button
            type="button"
            className="searchpill"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setOpen(true)}
          >
            <Search aria-hidden="true" />
            <span className="searchpill__text">Search…</span>
            <span className="searchpill__kbd" aria-hidden="true">
              <kbd>{apple ? "⌘" : "Ctrl"}</kbd>
              <kbd>K</kbd>
            </span>
          </button>

          <nav className="nav__links" aria-label="Tools">
            {pageList.map((page) => (
              <Link key={page.id} href={page.path} aria-current={pathname === page.path ? "page" : undefined}>
                {page.navLabel}
              </Link>
            ))}
          </nav>

          {actions}
        </div>
      </header>
    </>
  );
}
