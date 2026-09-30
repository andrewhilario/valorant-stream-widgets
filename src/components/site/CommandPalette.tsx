"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { pageList } from "@/config/pages";
import { usePalette, type PaletteItem } from "./PaletteProvider";

const GROUP_ORDER = ["Actions", "Settings", "Go to"];

function score(item: PaletteItem, tokens: string[]): number {
  const label = item.label.toLowerCase();
  const rest = `${item.detail ?? ""} ${item.words}`.toLowerCase();
  let total = 0;
  for (const token of tokens) {
    if (label.startsWith(token)) total += 3;
    else if (label.includes(token)) total += 2;
    else if (rest.includes(token)) total += 1;
    else return 0;
  }
  return total;
}

/**
 * ⌘K / Ctrl K: jump to any page, or to a setting or action on this one. A native <dialog>,
 * so the focus trap and Esc come free. Lives in the site layout, so it works on every page.
 */
export function CommandPalette() {
  const { open, setOpen, pageItems } = usePalette();
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const goTo: PaletteItem[] = pageList
      .filter((page) => page.path !== pathname)
      .map((page) => ({
        id: `go:${page.id}`,
        group: "Go to",
        label: page.navLabel,
        detail: page.h1,
        words: "page tool open navigate",
        run: () => router.push(page.path),
      }));
    return [...pageItems, ...goTo];
  }, [pageItems, pathname, router]);

  const grouped = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = items
      .map((item, order) => ({ item, order, s: tokens.length ? score(item, tokens) : 1 }))
      .filter((x) => x.s > 0);
    const names = [...new Set(scored.map((x) => x.item.group))].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return names.map((group) => ({
      group,
      rows: scored.filter((x) => x.item.group === group).sort((a, b) => b.s - a.s || a.order - b.order),
    }));
  }, [items, query]);

  const flat = useMemo(() => grouped.flatMap((g) => g.rows.map((r) => r.item)), [grouped]);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  // Open and close the native dialog from state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setActive(0);
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The shortcut.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current, grouped]);

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    // Close first, so the dialog hands focus back before the action moves it somewhere new.
    dialogRef.current?.close();
    setOpen(false);
    setTimeout(item.run, 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(flat.length ? (current + 1) % flat.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(flat.length ? (current - 1 + flat.length) % flat.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(flat[current]);
    }
  };

  let index = -1;

  return (
    <dialog
      ref={dialogRef}
      className="cmdk"
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="cmdk__panel">
        <div className="cmdk__field">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            className="cmdk__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length ? `${listId}-${current}` : undefined}
            aria-label="Search pages, settings and actions"
            placeholder="Search pages, settings and actions…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd>esc</kbd>
        </div>

        <div className="cmdk__results" id={listId} role="listbox" aria-label="Results" ref={listRef}>
          {grouped.map(({ group, rows }) => (
            <div key={group} role="group" aria-label={group}>
              <p className="cmdk__group" aria-hidden="true">
                {group}
              </p>
              {rows.map(({ item }) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === current}
                    className="cmdk__item"
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                  >
                    <span className="cmdk__label">{item.label}</span>
                    {item.detail && <span className="cmdk__detail">{item.detail}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <p className="cmdk__empty">Nothing matches “{query}”. Try a page name, or a setting like “accent” or “size”.</p>
          )}
        </div>

        <div className="cmdk__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>
              <CornerDownLeft />
            </kbd>{" "}
            choose
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {flat.length} {flat.length === 1 ? "result" : "results"}
        </span>
      </div>
    </dialog>
  );
}
