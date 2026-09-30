"use client";

import { useId, useState, type CSSProperties } from "react";
import type { ColorControl } from "@/lib/schema";
import { FieldGroup } from "./Field";

const HEX = /^[0-9a-f]{6}$/;

export function Swatches({
  control,
  value,
  onChange,
}: {
  control: ColorControl;
  value: string;
  onChange: (value: string) => void;
}) {
  const name = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const typed = draft ?? value;
  const invalid = draft !== null && draft !== "" && !HEX.test(draft);

  return (
    <FieldGroup label={control.label} help={control.help} helpId={`${name}-help`}>
      <div className="swatches">
        <label className="swatch swatch--theme">
          <input
            type="radio"
            name={name}
            value=""
            checked={value === ""}
            onChange={() => onChange("")}
            data-ctl={control.key}
          />
          <span className="swatch__chip">{control.emptyLabel}</span>
        </label>
        {control.swatches.map((swatch) => (
          <label key={swatch.value} className="swatch">
            <input
              type="radio"
              name={name}
              value={swatch.value}
              checked={value === swatch.value}
              onChange={() => onChange(swatch.value)}
              data-ctl={control.key}
              aria-label={swatch.label}
            />
            <span className="swatch__dot" style={{ "--swatch": `#${swatch.value}` } as CSSProperties} aria-hidden="true" />
          </label>
        ))}
      </div>

      <details className="advanced advanced--inline">
        <summary>Custom colour</summary>
        <div className="hexfield">
          <label className="hexfield__label" htmlFor={`${name}-hex`}>
            Hex
          </label>
          <span className="hexfield__box" data-invalid={invalid ? "true" : "false"}>
            <span aria-hidden="true">#</span>
            <input
              id={`${name}-hex`}
              className="hexfield__input"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              placeholder="ff4655"
              value={typed}
              aria-invalid={invalid}
              onChange={(event) => {
                const next = event.target.value.replace(/^#/, "").toLowerCase();
                setDraft(next);
                if (HEX.test(next)) onChange(next);
              }}
              onBlur={() => setDraft(null)}
            />
          </span>
          {invalid && <span className="hexfield__error">Six characters, 0–9 and a–f.</span>}
        </div>
      </details>
    </FieldGroup>
  );
}
