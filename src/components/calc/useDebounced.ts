import { useEffect, useState } from "react";

/** The value, `ms` after it stops changing. Used to keep screen-reader announcements from firing on every keystroke. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
