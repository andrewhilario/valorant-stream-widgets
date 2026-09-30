"use client";

import { useId } from "react";
import { Field } from "../controls/Field";

export type Option = { value: string; label: string };

/** A native select: the best picker on a phone, and keyboard and screen-reader friendly everywhere. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  help,
  ctl,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  help?: string;
  ctl: string;
}) {
  const id = useId();
  return (
    <Field label={label} help={help} helpId={`${id}-help`} htmlFor={id}>
      <span className="select">
        <select id={id} value={value} aria-describedby={`${id}-help`} onChange={(event) => onChange(event.target.value)} data-ctl={ctl}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </Field>
  );
}
