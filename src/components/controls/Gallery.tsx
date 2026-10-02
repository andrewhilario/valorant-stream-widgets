"use client";

import { useEffect, useId, type CSSProperties } from "react";
import type { ChoiceControl, ChoiceSwatch } from "@/lib/schema";
import { FieldGroup } from "./Field";

/** The traits in a swatch's `data` become data-* attributes, which the stylesheet reads to shape the miniature. */
function dataAttributes(data: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([name, value]) => [`data-${name}`, value]));
}

/** The widget in miniature, in a theme's own colours. Decorative: the card's name says what it is. */
function Thumb({ swatch }: { swatch: ChoiceSwatch }) {
  return (
    <span className="thumb" aria-hidden="true" style={swatch.vars as CSSProperties} {...dataAttributes(swatch.data)}>
      <span className="thumb__panel">
        <span className="thumb__mark thumb__mark--tl" />
        <span className="thumb__mark thumb__mark--br" />
        <span className="thumb__head">
          <span className="thumb__badge" />
          <span className="thumb__lines">
            <span />
            <span />
          </span>
          <span className="thumb__pill" />
        </span>
        <span className="thumb__track">
          <span className="thumb__fill" />
        </span>
      </span>
    </span>
  );
}

type Props = {
  control: ChoiceControl;
  value: string;
  onChange: (value: string) => void;
  /** Called with an option while a mouse or pen is over its card, and with null when it leaves. Touch just taps to pick. */
  onTry?: (key: string, value: string | null) => void;
};

/**
 * A choice drawn as cards, each a miniature of what it gives you, with its name under it. Pointing at one tries it on the
 * preview without picking it. It is still one radio group, so the keyboard works as it does on the segmented bar: the
 * arrow keys move and pick.
 */
export function Gallery({ control, value, onChange, onTry }: Props) {
  const name = useId();
  const { key } = control;

  // A card removed from under the pointer (another tab opening, say) never reports the pointer leaving.
  useEffect(() => () => onTry?.(key, null), [onTry, key]);

  return (
    <FieldGroup label={control.label} help={control.help} helpId={`${name}-help`}>
      <div className="gallery" onPointerLeave={() => onTry?.(key, null)}>
        {control.options.map((option) => (
          <label
            key={option.value}
            className="gallery__opt"
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") onTry?.(key, option.value);
            }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              data-ctl={key}
            />
            <span className="gallery__card">
              {option.swatch && <Thumb swatch={option.swatch} />}
              <span className="gallery__name">{option.label}</span>
              {option.note && <span className="gallery__note">{option.note}</span>}
            </span>
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}
