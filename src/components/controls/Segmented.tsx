"use client";

import { useId } from "react";
import type { ChoiceControl } from "@/lib/schema";
import { FieldGroup } from "./Field";

export function Segmented({
  control,
  value,
  onChange,
}: {
  control: ChoiceControl;
  value: string;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <FieldGroup label={control.label} help={control.help} helpId={`${name}-help`}>
      <div className="seg">
        {control.options.map((option) => (
          <label key={option.value} className="seg__opt">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              data-ctl={control.key}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}
