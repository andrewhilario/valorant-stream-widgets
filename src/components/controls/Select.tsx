"use client";

import { useId } from "react";
import type { ChoiceControl } from "@/lib/schema";
import { Field } from "./Field";

export function SelectControl({
  control,
  value,
  onChange,
}: {
  control: ChoiceControl;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field label={control.label} help={control.help} helpId={`${id}-help`} htmlFor={id}>
      <span className="select">
        <select
          id={id}
          value={value}
          aria-describedby={`${id}-help`}
          onChange={(event) => onChange(event.target.value)}
          data-ctl={control.key}
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </Field>
  );
}
