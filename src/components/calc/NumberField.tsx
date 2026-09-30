"use client";

import { useId, useState } from "react";
import { Field } from "../controls/Field";

/**
 * A number typed as text, so "12,000", "35.5" and "0,5" all work and there are no spinner arrows. The value stays a
 * string in the parent; lib/fields.ts reads it. The error shows once the field has been left, so typing "5" on the way
 * to "55" isn't scolded.
 */
export function NumberField({
  label,
  value,
  onChange,
  error,
  help,
  integer,
  placeholder,
  ctl,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** What's wrong with the value right now, in words. */
  error?: string | null;
  help?: string;
  integer?: boolean;
  placeholder?: string;
  ctl: string;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const shown = touched ? (error ?? null) : null;

  return (
    <Field label={label} help={help} error={shown} helpId={`${id}-help`} htmlFor={id}>
      <span className="input" data-state={shown ? "error" : "none"}>
        <input
          id={id}
          className="input__control input__control--plain"
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${id}-help`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
          data-ctl={ctl}
        />
      </span>
    </Field>
  );
}
