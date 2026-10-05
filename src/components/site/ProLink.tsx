"use client";

import { Sparkles } from "lucide-react";
import { pro } from "@/config/site";
import { track } from "@/lib/analytics";

/**
 * "Pro (coming soon)": a quiet link to a short form that asks what people would pay for. It only shows while the form's
 * address is set (see config/site.ts), and each click is counted anonymously with where on the page it was.
 */
export function ProLink({ variant = "chip", where }: { variant?: "chip" | "link"; where: "footer" | "editor" }) {
  if (!pro.interestUrl) return null;
  return (
    <a
      className={variant === "chip" ? "chip" : "textlink"}
      href={pro.interestUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("pro_click", where)}
    >
      <Sparkles aria-hidden="true" />
      <span>Pro (coming soon)</span>
    </a>
  );
}
