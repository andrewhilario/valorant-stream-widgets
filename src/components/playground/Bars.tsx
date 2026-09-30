"use client";

import { usePlayground } from "./usePlayground";
import { CopyButton } from "./CopyButton";
import { describeStatus, useNow } from "./Status";

/** Phones only: the copy action stays under your thumb while you work through the settings. */
export function StickyBar() {
  const pg = usePlayground();
  const now = useNow(5000);
  const { tone, label } = describeStatus(pg, now);

  return (
    <aside className="stickybar" aria-label="Copy your link">
      <p className="stickybar__status" data-tone={tone}>
        <span className="status__dot" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <CopyButton />
    </aside>
  );
}

/** Reset is undoable for a few seconds instead of asking "are you sure?". Fixed to a corner, so nothing shifts. */
export function UndoBar() {
  const { canUndo, undo, dismissUndo } = usePlayground();
  if (!canUndo) return null;

  return (
    <div className="undobar" role="status">
      <span>Look and layout reset.</span>
      <button type="button" className="linkbtn" onClick={undo}>
        Undo
      </button>
      <button type="button" className="linkbtn linkbtn--muted" onClick={dismissUndo}>
        Dismiss
      </button>
    </div>
  );
}
