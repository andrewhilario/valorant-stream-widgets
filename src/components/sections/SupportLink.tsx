import { Coffee } from "lucide-react";
import { supportUrl } from "@/config/site";

/** Buy Me a Coffee. Quiet by design: an outlined chip or a plain text link, never a yellow block. */
export function SupportLink({ variant = "chip" }: { variant?: "chip" | "link" }) {
  return (
    <a className={variant === "chip" ? "chip" : "textlink"} href={supportUrl} target="_blank" rel="noopener noreferrer">
      <Coffee aria-hidden="true" />
      <span>Buy me a coffee</span>
    </a>
  );
}
