"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type PaletteItem = {
  id: string;
  /** "Actions" and "Settings" come from the page; "Go to" is added for every page. */
  group: string;
  label: string;
  detail?: string;
  /** Extra words that should find this item. */
  words: string;
  run: () => void;
};

type PaletteContextValue = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  pageItems: PaletteItem[];
  setPageItems: (items: PaletteItem[]) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

/** Holds the palette's open state and whatever the current page wants listed in it. */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pageItems, setPageItemsState] = useState<PaletteItem[]>([]);
  const setPageItems = useCallback((items: PaletteItem[]) => setPageItemsState(items), []);

  const value = useMemo(() => ({ open, setOpen, pageItems, setPageItems }), [open, pageItems, setPageItems]);
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteContextValue {
  const value = useContext(PaletteContext);
  if (!value) throw new Error("usePalette must be used inside <PaletteProvider>");
  return value;
}

/** A page lists its own settings and actions in the palette. Keep `items` memoised. */
export function usePaletteItems(items: PaletteItem[]) {
  const { setPageItems } = usePalette();
  useEffect(() => {
    setPageItems(items);
    return () => setPageItems([]);
  }, [items, setPageItems]);
}
