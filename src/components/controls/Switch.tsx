"use client";

import { useId } from "react";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Why it is off-limits, when disabled. Shown, not just implied. */
  hint?: string;
  disabled?: boolean;
  ctl: string;
  flag?: string;
};

/** A real checkbox with role="switch". The track is decoration. */
export function Switch({ label, checked, onChange, hint, disabled, ctl, flag }: Props) {
  const id = useId();
  return (
    <label className="switch" data-disabled={disabled ? "true" : "false"}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        data-ctl={ctl}
        data-flag={flag}
      />
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {hint && (
          <span className="switch__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )}
      </span>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </label>
  );
}
