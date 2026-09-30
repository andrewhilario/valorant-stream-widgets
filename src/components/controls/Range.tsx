"use client";

import { useId, type CSSProperties } from "react";
import type { RangeControl } from "@/lib/schema";
import { Field } from "./Field";

export function Range({
  control,
  value,
  onChange,
}: {
  control: RangeControl;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const fill = ((value - control.min) / (control.max - control.min)) * 100;

  return (
    <Field
      label={control.label}
      help={control.help}
      helpId={`${id}-help`}
      htmlFor={id}
      aside={
        <output className="field__value" htmlFor={id}>
          {value}
          {control.unit === "%" ? "%" : ` ${control.unit}`}
        </output>
      }
    >
      <input
        id={id}
        className="range"
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        aria-describedby={`${id}-help`}
        data-ctl={control.key}
      />
    </Field>
  );
}
