"use client";

import { Check, CircleAlert, ExternalLink, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import { track } from "@/lib/analytics";
import type { PreviewStatus } from "@/lib/preview";
import type { TextControl } from "@/lib/schema";
import { Field } from "./Field";

type Lookup = { status: PreviewStatus; account: string | null; tier: string | null; configured: boolean; sample: boolean };
type Slot = "none" | "busy" | "ok" | "error";

export function TextField({
  control,
  value,
  onChange,
  lookup,
}: {
  control: TextControl;
  value: string;
  onChange: (value: string) => void;
  lookup: Lookup;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const formatError = touched ? (control.validate?.(value) ?? null) : null;

  // Helper line: format problems first, then how the live lookup is going.
  let error: string | null = formatError;
  let help = control.help;
  let slot: Slot = formatError ? "error" : "none";

  const { status } = lookup;
  const looking = lookup.configured && !lookup.sample && !formatError;

  if (control.liveFor === "account" && looking) {
    if (status.state === "loading") {
      help = "Looking up your account…";
      slot = "busy";
    } else if (status.state === "live" && lookup.account) {
      help = `Found ${lookup.account}${lookup.tier ? ` · ${lookup.tier}` : ""}`;
      slot = "ok";
    } else if (status.state === "error" && status.code === "not_found") {
      error = status.message;
      slot = "error";
    }
  }

  if (control.liveFor === "key" && looking) {
    if (status.state === "error" && (status.code === "bad_key" || status.code === "rate_limited")) {
      error = status.message;
      slot = "error";
    } else if (status.state === "live") {
      help = "HenrikDev accepted this key.";
      slot = "ok";
    } else if (status.state === "loading") {
      help = "Checking the key…";
      slot = "busy";
    }
  }

  const secret = Boolean(control.secret);
  const learn = control.learnMore;
  // Whether the steps for getting a key get opened, and whether people go on to the dashboard, is how we learn how much the key
  // step costs. The only such field is the key (it's the secret one); nothing typed into it is ever counted.
  const countKeyHelp = secret;

  return (
    <Field
      label={control.label}
      help={help}
      error={error}
      helpId={`${id}-help`}
      htmlFor={id}
      after={
        learn && (
          <details
            className="advanced advanced--inline"
            onToggle={(event) => {
              if (countKeyHelp && event.currentTarget.open) track("key_help", "steps");
            }}
          >
            <summary>{learn.summary}</summary>
            <div className="howto">
              <ol className="howto__steps">
                {learn.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                className="textlink"
                href={learn.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (countKeyHelp) track("key_help", "dashboard");
                }}
              >
                <span>{learn.hrefLabel}</span>
                <ExternalLink aria-hidden="true" />
              </a>
            </div>
          </details>
        )
      }
    >
      <span className="input" data-state={slot} data-secret={secret}>
        <input
          id={id}
          className="input__control"
          type={secret && !revealed ? "password" : "text"}
          value={value}
          placeholder={control.placeholder}
          maxLength={control.maxLength}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore={secret ? "true" : undefined}
          data-lpignore={secret ? "true" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          aria-busy={slot === "busy" ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
          data-ctl={control.key}
        />
        {secret && (
          <button
            type="button"
            className="input__reveal"
            aria-label={revealed ? "Hide key" : "Show key"}
            aria-pressed={revealed}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        )}
        <span className="input__slot" aria-hidden="true">
          {slot === "busy" && <LoaderCircle className="input__icon input__icon--busy" />}
          {slot === "ok" && <Check className="input__icon input__icon--ok" />}
          {slot === "error" && <CircleAlert className="input__icon input__icon--error" />}
        </span>
      </span>
    </Field>
  );
}
